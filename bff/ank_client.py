import grpc
import grpc.aio
from google.protobuf.json_format import MessageToDict
import kernel_pb2
import kernel_pb2_grpc


class AnkClient:
    def __init__(self, target="localhost:50051"):
        self.target = target
        self.channel = None
        self.stub = None

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

    async def get_system_status(self, tenant_id: str, session_key: str):
        """
        Fetches the current health and hardware usage of the Kernel.
        """
        if not self.stub:
            self.channel = grpc.aio.insecure_channel(self.target)
            self.stub = kernel_pb2_grpc.KernelServiceStub(self.channel)

        metadata = self._get_metadata(tenant_id, session_key)

        try:
            response = await self.stub.GetSystemStatus(
                kernel_pb2.Empty(), metadata=metadata
            )
            return MessageToDict(response, preserving_proto_field_name=True)
        except grpc.RpcError as e:
            print(f"gRPC Error in GetSystemStatus: {e}")
            raise
