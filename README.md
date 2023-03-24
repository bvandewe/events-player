# Attempts Aggregator

REST API that collects and analyzes a set of `AttemptScoreReports` and produces the corresponding monthly and weekly performance reports at the Track/Form/Item levels (including Volume, PassRate, UniqueLocations, Unique)

[[_TOC_]]

## Overall

This app exposes a simple REST API that:

1. receives a query via HTTP GET, including few parameters (report_type, time_range, sampling_frequency, track_qualified_name)
2. collects  then analyze data accordingly,
3. ultimately returns aggregated/summarized data in JSON according to the query parameters.

Specifically:

- The endpoint differentiates few report types with a path parameter (incl. 'track', 'module', 'form', 'item') that defines the content depth of the report.
- The query includes parameters about the time range (`start_date`, `end_date`) and `sampling_frequency` (daily, weekly, monthly, quarterly, yearly) based on the fiscal calendar of Cisco Systems over multiple years, starting in 2020
- The app collects the attempts data from a 3rd party service that returns data in JSON as an array of attempts' records
- An [attempt record](#attemptscorereports) represent the full score report for the exam attempt (mainly including details about the candidate, the location where the attempt was taken, the total score, the score for each exam module, the score, maximum score and answer key for each exam question/item for each module)
- The app summarizes the attempts data according to the query's sampling frequency, computing key performance indicators for each sample period and returns the summarized data as an array in JSON
- The response includes metadata (the query parameters, length of the response.data) and an array of report entries
- A report entry includes key performance indicators about the exam performances, including the volume (amount of attempts during the sample period), pass_count (amount of passed attempts during the sample period), pass_rate (ratio of passed attempts versus volume, during the sample period), avg_attempt_to_pass, etc

The app use [FastAPI](https://fastapi.tiangolo.com/) for the REST API (including [Pydantic](https://docs.pydantic.dev/) for full input validation and env/settings management) and [Pandas](https://pandas.pydata.org/) for data analytics and summarization.

The intent of this app is really `just` to produce the performance reports in JSON format, given a set of `AttemptScoreReports`. Other apps can later consume this JSON in order to refresh Mozart Indicators and/or produce on-demand reports.xlsx.

## Input

- A path parameter defines the depth-level of the report:
  - `track`: include track-level report only
  - `module`: include track- and module-level reports
  - `form`: include track-, module-, form-level reports
  - `item`: include track-, module-, form-, item-level reports
- Few body parameters define the data query:
  - `start_date`: the start date of the time range to pull from the 3rd party service, defaults to `fiscalYearStart`
  - `end_date`: the end date of the time range to pull from the 3rd party service, defaults to `today`
  - `sampling_frequency`: the size of the each sample for the aggregation (e.g. daily, weekly, monthly, quarterly, yearly)
  - `track_qualified_name`: the standardized qualified name for the track for which to pull the data and produce the report (e.g. `Exam CCIE INF`, `Exam CCIE DC`, `Exam CCDE CCDE`, `PL CCIE INF`, ...)
- Some environment variables define:
  - `api_log_level`: standard DEBUG|INFO|WARNING|ERROR
  - `api_data_settings`: including options and settings about the data collection

## Usage

When deployed, the app exposes a Swagger UI at: http://localhost:8888/api/docs.

The endpoints are at `POST`:`{baseUrl}/api/v1/reports/{report_type}` where `{report_type}` can be `track`, `exam`, `module`, `item`.

## AttemptScoreReports

The source data is an array of flat records (no nested attributes!) that looks like shown below.

Each record may have different attributes, depending on the ExamForm (e.g. DES-1.1 may have 20 items,
while DES-1.2 may have 23 items!).

Pandas can easily filter and aggregate this datatable! It makes the analytics much easier,
even if the data seems humongus!

```json
[
    {
        "domain": "exam",
        "location": "Beijing",
        "pod_name": "SJ03",
        "version": 1,
        "first_name": "CandidateFirstName",
        "last_name": "CandidateLastName",
        "csco_id": "CSCO123456",
        "attempt": 1,
        "overall_pf": "Pass",
        "track": "Enterprise Infrastructure",
        "candidate_id": "123456789",
        "rcu_parent_reservation_id": 12345,
        "lab_date": "2023-02-03T00:00:00",
        "submission_timestamp": "2023-02-03 08:10:29",
        "submit_status": "SUBMITTED",
        "submitted_by": "graderUsername",
        "m1_report_id": 123456,
        "m1_LDS_sid": 2134,
        "m1_LDS_pid": 1,
        "m1_LDS_url": "https://150.101.0.22",
        "m1_type": "DES",
        "m1_version": "DES-1.2",
        "m1_grader_username": "graderUsername",
        "m1_max_score": 37,
        "m1_cut_score": 29,
        "m1_min_score": 26,
        "m1_score": 31,
        "m1_scaling_ratio": 0.5,
        "m1_pf": "Pass",
        "m1_i1_name": "1: Introduction",
        "m1_i1_uuid": "614a16009493585cd64bd7ec",
        "m1_i1_ft": "false",
        "m1_i1_max_score": 0,
        "m1_i1_type": "unscored",
        "m1_i1_score": 0,

        "m1_i2_name": "2: RSTP Deployment",
        "m1_i2_uuid": "614a15fe9493585cd64bd5fd",
        "m1_i2_ft": "false",
        "m1_i2_domain": "1.0 Network Infrastructure",
        "m1_i2_max_score": 1,
        "m1_i2_type": "web",
        "m1_i2_score": 1,
        "m1_i2_q1_max_score": 1,
        "m1_i2_q1_score": 1,
        "m1_i2_q1_res_key": "#1.2.1: [ {\"1\":\"Configure ports toward end hosts as edge ports\"} ]",
        ...

        "m2_report_id": 12345,
        "m2_LDS_sid": 12333,
        "m2_LDS_pid": 2,
        "m2_LDS_url": "https://150.101.0.22",
        "m2_type": "DOO",
        "m2_version": "DOO-1.2",
        "m2_grader_username": "graderUsername",
        "m2_max_score": 63,
        "m2_cut_score": 46,
        "m2_min_score": 41,
        "m2_score": 53,
        "m2_scaling_ratio": 1.0,
        "m2_pf": "Pass",
        "m2_i1_name": "1.1: Introduction",
        "m2_i1_max_score": 0,
        "m2_i1_type": "unscored",
        "m2_i1_score": 0,
        "m2_i2_name": "1.2: Layer2 Technologies In HQ",
        "m2_i2_domain": "1.0 Network Infrastructure",
        "m2_i2_max_score": 2,
        "m2_i2_type": "practical",
        "m2_i2_score": 2,
        ...
        "m2_i14_name": "1.14: Multicast in FABD2",
        "m2_i14_domain": "1.0 Network Infrastructure",
        "m2_i14_max_score": 2,
        "m2_i14_type": "web",
        "m2_i14_score": 0,
        "m2_i14_q1_max_score": 2,
        "m2_i14_q1_score": 0,
        "m2_i14_q1_res_key": "#1.14.1: [ [ {\"1\":\"<p>First Hop Router<br\/><\/p>\"}, {\"2\":\"<p>Last Hop Router<br\/><\/p>\"}, {\"3\":\"<p>Intermediary Hop Router<br\/><\/p>\"} ], [ {\"1\":\"<p>First Hop Router<br\/><\/p>\"}, {\"2\":\"<p>Last Hop Router<br\/><\/p>\"}, {\"3\":\"<p>Intermediary Hop Router<br\/><\/p>\"} ], [ {\"1\":\"<p>First Hop Router<br\/><\/p>\"}, {}, {} ], [ {\"1\":\"<p>First Hop Router<br\/><\/p>\"}, {}, {} ], [ {}, {\"2\":\"<p>Last Hop Router<br\/><\/p>\"}, {} ], [ {\"1\":\"<p>First Hop Router<br\/><\/p>\"}, {\"2\":\"<p>Last Hop Router<br\/><\/p>\"}, {} ] ]",
        ....

    },
    {
      ...
    }
]
```

## Reports

The output report is structured as follows:

```json
{
  "start_date": "2023-01-01",
  "end_date": "2023-03-03",
  "frequency": "month",
  "report_type": "track",
  "track_qualified_name": "Exam CCIE DEV",
  "data": {
    "track": {
      "report_name": "Track",
      "index_name": "FiscalMonths",
      "index_values": [
        "FY22-Q4M1",
        "FY22-Q4M2",
        "FY22-Q4M3",
        "FY23-Q1M1",
        "FY23-Q1M2",
        "FY23-Q1M3",
        "FY23-Q2M1",
        "FY23-Q2M2",
        "FY23-Q2M3",
        "FY23-Q3M1",
        "FY23-Q3M2"
      ],
      "columns_name": [
        "lab_vol",
        "lab_pass",
        "lab_pr",
        "avg_score",
        "min_score",
        "max_score",
        "avg_attempt",
        "avg_attempt_to_pass"
      ],
      "records_length": 11,
      "records": [
        {
          "lab_vol": 13,
          "lab_pass": 0,
          "lab_pr": 0,
          "avg_score": 29.385,
          "min_score": 12,
          "max_score": 57,
          "avg_attempt": 1,
          "avg_attempt_to_pass": 0
        },
        {
          "lab_vol": 8,
          "lab_pass": 0,
          "lab_pr": 0,
          "avg_score": 45.25,
          "min_score": 2,
          "max_score": 70,
          "avg_attempt": 1.625,
          "avg_attempt_to_pass": 0
        },
        {
          "lab_vol": 5,
          "lab_pass": 1,
          "lab_pr": 20,
          "avg_score": 41,
          "min_score": 9,
          "max_score": 88,
          "avg_attempt": 2,
          "avg_attempt_to_pass": 3
        },
        {
          "lab_vol": 2,
          "lab_pass": 0,
          "lab_pr": 0,
          "avg_score": 38.5,
          "min_score": 26,
          "max_score": 51,
          "avg_attempt": 2.5,
          "avg_attempt_to_pass": 0
        },
        {
          "lab_vol": 5,
          "lab_pass": 0,
          "lab_pr": 0,
          "avg_score": 29.4,
          "min_score": 8,
          "max_score": 55,
          "avg_attempt": 1,
          "avg_attempt_to_pass": 0
        },
        {
          "lab_vol": 5,
          "lab_pass": 0,
          "lab_pr": 0,
          "avg_score": 22.2,
          "min_score": 4,
          "max_score": 33,
          "avg_attempt": 1.4,
          "avg_attempt_to_pass": 0
        },
        {
          "lab_vol": 3,
          "lab_pass": 0,
          "lab_pr": 0,
          "avg_score": 33.667,
          "min_score": 8,
          "max_score": 56,
          "avg_attempt": 1.667,
          "avg_attempt_to_pass": 0
        },
        {
          "lab_vol": 5,
          "lab_pass": 1,
          "lab_pr": 20,
          "avg_score": 51,
          "min_score": 15,
          "max_score": 77,
          "avg_attempt": 2.4,
          "avg_attempt_to_pass": 3
        },
        {
          "lab_vol": 6,
          "lab_pass": 1,
          "lab_pr": 16.67,
          "avg_score": 49.167,
          "min_score": 1,
          "max_score": 77,
          "avg_attempt": 2.167,
          "avg_attempt_to_pass": 5
        },
        {
          "lab_vol": 9,
          "lab_pass": 3,
          "lab_pr": 33.33,
          "avg_score": 61.889,
          "min_score": 10,
          "max_score": 88,
          "avg_attempt": 1.667,
          "avg_attempt_to_pass": 1.667
        },
        {
          "lab_vol": 7,
          "lab_pass": 1,
          "lab_pr": 14.29,
          "avg_score": 50.571,
          "min_score": 10,
          "max_score": 81,
          "avg_attempt": 1.429,
          "avg_attempt_to_pass": 3
        }
      ]
    },
    "module": [],
    "form": [],
    "item": []
  }
}
```

## Development

### Requirements

Python 3.10

- Additional support for typing (e.g. no need to have `from typing import Optional` or even `from typing import Union` anymore, we can use `optional_field: datetime | None = None` instead)

`Hint`:

- The debugger fails with vscode v1.75 (currently the latest version).
  Have to downgrade to 1.74: https://code.visualstudio.com/updates/v1_74 Then, disable automatic updates (settings > 'update': set to "none")
- Vscode: set `Python › Analysis: Type Checking Mode` to `strict`

### Run

1. Build image with tag, e.g. `0.1.0`: `docker build -t aggregator:0.1.0 .`
2. Run image locally with env vars set: e.g. (set password accordingly!!!) 
   
   ```json
   docker run --name aggregator -p 8888:80 -e api_data_settings='{"default_time_range_start": "5","report_svc_base_url": "http://150.101.0.124:8090/attempt_data/","report_svc_username": "360portal","report_svc_password": "T1meT0Sh1ne"}'  aggregator:0.1.0
   ```
   
   ```json
   docker run --name local-aggregator -p 8888:80 -e api_data_settings='{"default_time_range_start": "5","report_svc_base_url": "http://150.101.0.124:8090/attempt_data/","report_svc_username": "360portal","report_svc_password": "T1meT0Sh1ne"}'  aggregator:0.1.1
   ```
   
3. Browse to [http://localhost:8888/api/docs]
4. Enjoy!!

Alternatively: tag the image with `docker build -t ccie-gitlab.ccie.cisco.com:4567/esa/sys/bi/attempts/aggregator:0.1.0 .`, then push to gitlab registry!

```sh
TAG="0.1.8"
docker build -t ccie-gitlab.ccie.cisco.com:4567/esa/sys/bi/attempts/aggregator:$TAG .
docker login ccie-gitlab.ccie.cisco.com:4567
docker push ccie-gitlab.ccie.cisco.com:4567/esa/sys/bi/attempts/aggregator:$TAG

```
