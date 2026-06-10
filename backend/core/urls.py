from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .bankid import bankid_collect, bankid_initiate
from .views import (
    EmployerApplicationStatusView,
    EmployerApplicationsView,
    JobApplicationViewSet,
    JobPostingViewSet,
    MyDisclosuresView,
    OrganizationCreateView,
    ProfileView,
    partner_application_events,
)

router = DefaultRouter()
router.register(r"applications", JobApplicationViewSet, basename="applications")
router.register(r"postings", JobPostingViewSet, basename="postings")

urlpatterns = [
    path("me/", ProfileView.as_view(), name="me"),
    path("me/disclosures/", MyDisclosuresView.as_view(), name="my-disclosures"),
    path("", include(router.urls)),
    path(
        "employer/applications/",
        EmployerApplicationsView.as_view(),
        name="employer-applications",
    ),
    path(
        "employer/applications/<int:pk>/",
        EmployerApplicationStatusView.as_view(),
        name="employer-application-status",
    ),
    path(
        "employer/organizations/",
        OrganizationCreateView.as_view(),
        name="employer-organizations",
    ),
    path(
        "partner/application-events/",
        partner_application_events,
        name="partner-application-events",
    ),
    path("auth/bankid/initiate/", bankid_initiate, name="bankid-initiate"),
    path("auth/bankid/collect/", bankid_collect, name="bankid-collect"),
]
