from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import MessageViewSet

router = SimpleRouter(trailing_slash=False)
router.register("messages", MessageViewSet, basename="chat-message")

urlpatterns = [path("", include(router.urls))]

