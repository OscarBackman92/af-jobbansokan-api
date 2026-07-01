from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """Standard pagination, but clients may request bigger pages.

    The board wants every row in one round trip instead of walking
    20-row pages; ``?page_size=200`` covers all realistic trackers.
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 200
