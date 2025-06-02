import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

from .agent_manager import get_agent

logger = logging.getLogger(__name__)

class AskAgentView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        question = request.data.get("question")
        if not question:
            logger.warning("AskAgentView: Received request with missing question")
            return Response({"error": "Missing question"}, status=status.HTTP_400_BAD_REQUEST)

        logger.info(f"AskAgentView: Received question: {question}")

        agent = get_agent()
        try:
            response = agent.run(question)
            logger.info(f"AskAgentView: Returning response for question: {question}")
            return Response({"answer": response})
        except Exception as e:
            logger.error(f"AskAgentView: Exception while processing question: {question}", exc_info=True)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
