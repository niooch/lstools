from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import UserSerializer, RegisterSerializer, MeUpdateSerializer
from django.utils.http import urlsafe_base64_decode
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .tokens import email_verification_token
from .emails import send_verification_email

User = get_user_model()

class IsSelfOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.user.is_staff or obj == request.user

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all().order_by('id')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)

class MeUpdateView(generics.UpdateAPIView):
    serializer_class = MeUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()  

        # send verification email (best-effort)
        verification_sent = False
        try:
            send_verification_email(user, request)
            verification_sent = True
        except Exception:
            pass

        refresh = RefreshToken.for_user(user)
        data = {
            "user": UserSerializer(user).data,
            "tokens": {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
            "email_verification_sent": verification_sent,
        }
        headers = self.get_success_headers(serializer.data)
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)

class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        uidb64 = request.query_params.get("uid")
        token = request.query_params.get("token")
        if not uidb64 or not token:
            return Response({"detail": "Missing uid/token."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            uid = urlsafe_base64_decode(uidb64).decode()
            user = User.objects.get(pk=uid)
        except Exception:
            return Response({"detail": "Invalid link."}, status=status.HTTP_400_BAD_REQUEST)

        if user.is_email_verified:
            return Response({"detail": "Email already verified."}, status=status.HTTP_200_OK)

        if not email_verification_token.check_token(user, token):
            return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)

        user.is_email_verified = True
        user.email_verified_at = timezone.now()
        user.save(update_fields=["is_email_verified", "email_verified_at"])
        return Response({"detail": "Email verified successfully."}, status=status.HTTP_200_OK)

class ResendVerificationView(APIView):
    """
    Accepts either:
      - authenticated user (no body), or
      - anonymous with {"email": "..."}.
    Always responds generically to avoid account enumeration.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        user = None

        if request.user and request.user.is_authenticated:
            user = request.user
        elif email:
            try:
                user = User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                user = None

        if user and not user.is_email_verified:
            try:
                send_verification_email(user, request)
            except Exception:
                # don't leak errors; rely on logs in real prod
                pass

        # Generic response
        return Response({"detail": "If the account exists and is unverified, an email was sent."})

