import os
import grpc
import grpc.aio
from google.protobuf.json_format import MessageToDict
import kernel_pb2
import kernel_pb2_grpc
import siren_pb2
import siren_pb2_grpc


class AnkClient:
    def __init__(self, target=None):
        self.target = target or os.environ.get("ANK_TARGET", "localhost:50051")
        self.channel = None
        self.stub = None
        self.siren_stub = None

    async def __aenter__(self):
        self.channel = grpc.aio.insecure_channel(self.target)
        self.stub = kernel_pb2_grpc.KernelServiceStub(self.channel)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.channel:
            await self.channel.close()

    def _get_metadata(self, tenant_id: str, session_key: str):
        return [("x-aegis-tenant-id", tenant_id), ("x-aegis-session-key", session_key)]

    async def submit_task(self, prompt: str, tenant_id: str, session_key: str):
        """
        Submits a task to the Kernel via gRPC.
        """
        if not self.stub:
            self.channel = grpc.aio.insecure_channel(self.target)
            self.stub = kernel_pb2_grpc.KernelServiceStub(self.channel)

        request = kernel_pb2.TaskRequest(
            prompt=prompt, tenant_id=tenant_id, priority=kernel_pb2.PRIORITY_NORMAL
        )

        metadata = self._get_metadata(tenant_id, session_key)

        try:
            response = await self.stub.SubmitTask(request, metadata=metadata)
            return response.pid
        except grpc.RpcError as e:
            print(f"gRPC Error in SubmitTask: {e}")
            raise

    async def watch_task(self, pid: str, tenant_id: str, session_key: str):
        """
        Streams events from the Kernel for a specific task.
        Returns a generator of JSON-serializable dicts.
        """
        if not self.stub:
            self.channel = grpc.aio.insecure_channel(self.target)
            self.stub = kernel_pb2_grpc.KernelServiceStub(self.channel)

        subscription = kernel_pb2.TaskSubscription(pid=pid, tenant_id=tenant_id)

        metadata = self._get_metadata(tenant_id, session_key)

        try:
            async for event in self.stub.WatchTask(subscription, metadata=metadata):
                # Convert the proto message to a flat dictionary for the UI
                event_dict = MessageToDict(event, preserving_proto_field_name=True)
                # Map gRPC 'oneof' payload into a consistent structure for WebSocket
                yield event_dict
        except grpc.RpcError as e:
            print(f"gRPC Error in WatchTask: {e}")
            raise

    async def get_system_status(self, tenant_id: str = None, session_key: str = None):
        """
        Fetches the current health and hardware usage of the Kernel.
        """
        if not self.stub:
            self.channel = grpc.aio.insecure_channel(self.target)
            self.stub = kernel_pb2_grpc.KernelServiceStub(self.channel)

        metadata = (
            self._get_metadata(tenant_id, session_key)
            if tenant_id and session_key
            else []
        )

        try:
            response = await self.stub.GetSystemStatus(
                kernel_pb2.Empty(), metadata=metadata
            )
            return MessageToDict(
                response,
                preserving_proto_field_name=True,
                including_default_value_fields=True,
            )
        except grpc.RpcError as e:
            print(f"gRPC Error in GetSystemStatus: {e}")
            raise

    async def initialize_master_admin(self, username: str, passphrase: str):
        if not self.stub:
            self.channel = grpc.aio.insecure_channel(self.target)
            self.stub = kernel_pb2_grpc.KernelServiceStub(self.channel)

        request = kernel_pb2.AdminSetupRequest(username=username, passphrase=passphrase)

        # Admin initialization doesn't need auth metadata
        try:
            response = await self.stub.InitializeMasterAdmin(request)
            return MessageToDict(
                response,
                preserving_proto_field_name=True,
                including_default_value_fields=True,
            )
        except grpc.RpcError as e:
            print(f"gRPC Error in InitializeMasterAdmin: {e}")
            raise

    async def create_tenant(
        self, username: str, admin_tenant_id: str, admin_session_key: str
    ):
        if not self.stub:
            self.channel = grpc.aio.insecure_channel(self.target)
            self.stub = kernel_pb2_grpc.KernelServiceStub(self.channel)

        request = kernel_pb2.TenantCreateRequest(username=username)
        metadata = self._get_metadata(admin_tenant_id, admin_session_key)

        try:
            response = await self.stub.CreateTenant(request, metadata=metadata)
            return MessageToDict(
                response,
                preserving_proto_field_name=True,
                including_default_value_fields=True,
            )
        except grpc.RpcError as e:
            print(f"gRPC Error in CreateTenant: {e}")
            raise

    async def configure_engine(
        self,
        tenant_id: str,
        session_key: str,
        api_url: str,
        model_name: str,
        api_key: str,
    ):
        if not self.stub:
            self.channel = grpc.aio.insecure_channel(self.target)
            self.stub = kernel_pb2_grpc.KernelServiceStub(self.channel)

        request = kernel_pb2.EngineConfigRequest(
            api_url=api_url, model_name=model_name, api_key=api_key
        )
        metadata = self._get_metadata(tenant_id, session_key)

        try:
            await self.stub.ConfigureEngine(request, metadata=metadata)
            return True
        except grpc.RpcError as e:
            print(f"gRPC Error in ConfigureEngine: {e}")
            raise

    async def reset_tenant_password(
        self,
        tenant_id: str,
        new_passphrase: str,
        admin_tenant_id: str,
        admin_session_key: str,
    ):
        if not self.stub:
            self.channel = grpc.aio.insecure_channel(self.target)
            self.stub = kernel_pb2_grpc.KernelServiceStub(self.channel)

        request = kernel_pb2.PasswordResetRequest(
            tenant_id=tenant_id, new_passphrase=new_passphrase
        )
        metadata = self._get_metadata(admin_tenant_id, admin_session_key)

        try:
            await self.stub.ResetTenantPassword(request, metadata=metadata)
            return True
        except grpc.RpcError as e:
            print(f"gRPC Error in ResetTenantPassword: {e}")
            raise

    async def siren_stream(self, tenant_id: str, session_key: str, chunk_generator):
        """
        Bi-directional stream for audio processing (Siren Protocol).
        Passes a generator to gRPC and yields events back to the caller.
        """
        if not self.siren_stub:
            if not self.channel:
                self.channel = grpc.aio.insecure_channel(self.target)
            self.siren_stub = siren_pb2_grpc.SirenServiceStub(self.channel)

        metadata = self._get_metadata(tenant_id, session_key)

        try:
            # Note: In gRPC Python aio, calling a stream-stream returns a call object
            # that is an async iterator for the response stream.
            call = self.siren_stub.SirenStream(chunk_generator, metadata=metadata)
            async for event in call:
                yield MessageToDict(event, preserving_proto_field_name=True)
        except grpc.RpcError as e:
            print(f"gRPC Error in SirenStream: {e}")
            raise
        finally:
            # SRE Safety: Ensure the gRPC call is cancelled if the consumer stops
            # this prevents "zombie" streams in the Kernel.
            try:
                if not call.done():
                    call.cancel()
            except Exception:
                pass
