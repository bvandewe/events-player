# Helm Chart

## CLI

```sh
# root folder
cd .

# Install
helm install <release-name> <chart> [flags]
# Common Flags
#   --set key=value: Override values in the chart.
#   --values or -f: Specify a YAML file with values to override.
#   --namespace: Specify the namespace to install the release into.
#   --version: Specify the version of the chart to install.

helm template events-player .deployment/helm --namespace cloud-streams --debug

helm template events-player .deployment/helm --namespace cloud-streams -f .deployment/helm/events-player/values-dev.yaml --debug

helm install events-player .deployment/helm --namespace cloud-streams -f .deployment/helm/events-player/values-dev.yaml

helm upgrade events-player .deployment/helm --namespace cloud-streams -f .deployment/helm/events-player/values-dev.yaml

```