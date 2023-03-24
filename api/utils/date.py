from datetime import datetime, timedelta


def subtract_days(date_string: str, days_to_subtract: int):
    date = datetime.strptime(date_string, "%Y-%m-%d")
    new_date = date - timedelta(days=days_to_subtract)
    new_date_string = new_date.strftime("%Y-%m-%d")
    return new_date_string

def check_date_consistency(start_date: str, end_date: str) -> bool:
    start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
    end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
    return start_datetime < end_datetime