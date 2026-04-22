from enum import Enum


class ChatAgentRoute(str, Enum):
    """Specialist agent roles for conversational turns."""

    intake = "intake"
    wellness = "wellness"
    scheduling = "scheduling"
    clinical_documentation = "clinical_documentation"


class DocumentKind(str, Enum):
    """Report classifier agent output."""

    lab_panel = "lab_panel"
    imaging_radiology = "imaging_radiology"
    pathology_histology = "pathology_histology"
    mixed_clinical = "mixed_clinical"
    administrative_other = "administrative_other"
