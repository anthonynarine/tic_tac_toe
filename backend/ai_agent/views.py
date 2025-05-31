# backend/ai_agent/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from rest_framework.permissions import AllowAny
from rest_framework import status
from .langchain_agent import build_agent

# 🔁 Only load once on startup
agent = build_agent()


class AskAgentView(APIView):
    """
    Public API endpoint for asking questions about your Django project.
    No authentication required. Input is limited to questions only.
    """
    permission_classes = [AllowAny]  

    def post(self, request):
        question = request.data.get("question")
        if not question:
            return Response({"error": "Missing question"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            response = agent.run(question)
            return Response({"answer": response})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
