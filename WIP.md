- [ ] Improved timeline interactions similar to grafana's typical time-range selection and auto-refresh

Improved UX with filtering the entire view (including events' stream, timeline and all other charts):

whenever clicking on any chart (there are a few others), then the global filters should be updated accordingly as follows:
timeline chart: click on a bar (i.e. a bucket with non-zero data) results in adding and applying to the global filter the selected bucket' time range and therefore refreshes all other charts accordingly, including the events stream
analytics charts: click on any horizontal bar results in adding and applying to the global filter to the selected event source/type/subject therefore refreshes all other charts accordingly, including the events stream
filters should