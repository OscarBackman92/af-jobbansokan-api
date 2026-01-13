from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import JobApplicationViewSet, me

router = DefaultRouter()
router.register("applications", JobApplicationViewSet, basename="applications")

urlpatterns = [
    path("me/", me, name="me"),
    path("", include(router.urls)),
]