from rest_framework.throttling import ScopedRateThrottle


class UploadThrottle(ScopedRateThrottle):
    scope = "upload"


class JobTechThrottle(ScopedRateThrottle):
    scope = "jobtech"
