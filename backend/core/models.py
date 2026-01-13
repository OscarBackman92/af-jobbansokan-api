from django.conf import settings
from django.db import models

class JobApplication(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_applications",
    )
    company = models.CharField(max_length=255)
    role = models.CharField(max_length=255)
    applied_at = models.DateField()
    status = models.CharField(
        max_length=50,
        choices=[
            ("applied", "Applied"),
            ("interview", "Interview"),
            ("offer", "Offer"),
            ("rejected", "Rejected"),
        ],
        default="applied",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self) -> str:
        return f"{self.company} – {self.role}"

