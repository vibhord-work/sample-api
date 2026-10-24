# Sample API — GitOps Deployment with Argo CD

## 1. Project Overview

This project demonstrates the deployment of a containerized Node.js application to a local Kubernetes cluster using GitOps principles and Argo CD.

The application is packaged as a Docker image, published to Docker Hub, and deployed through Kubernetes manifests maintained in GitHub.

Argo CD continuously monitors the Git repository and automatically synchronizes Kubernetes resources with the desired configuration.

## 2. Technologies Used

| Technology | Purpose |
|---|---|
| GitHub | Source code and GitOps configuration repository |
| Docker | Application containerization |
| Docker Hub | Container image registry |
| Kubernetes | Container orchestration |
| kind | Local Kubernetes cluster |
| Argo CD | GitOps continuous delivery |
| kubectl | Kubernetes administration |
| Node.js | Sample API application |

## 3. GitOps Architecture

```text
              Developer
                  |
                  | Git Push
                  v
         GitHub Repository
       vibhord-work/sample-api
                  |
                  | Kubernetes YAML
                  v
            Argo CD
        Application Controller
                  |
                  | Automatic Sync
                  v
          Kubernetes Cluster
             (kind)
                  |
          +-------+-------+
          |               |
       Deployment      ConfigMap
          |
       Service
          |
     +----+----+----+
     |         |    |
    Pod 1    Pod 2  Pod 3
     |         |    |
     +---------+----+
          |
     Sample API
```

The application image is built using Docker and stored in Docker Hub as `vibhord/sample-api:gitops-v1`. Kubernetes pulls this image when creating application pods.

## 4. Repository Structure

```text
sample-api/
├── app.js
├── package.json
├── package-lock.json
├── Dockerfile
├── Jenkinsfile
├── k8s/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
├── application.yaml
└── README.md
```

## 5. Kubernetes Configuration

### Deployment

The Deployment manages the Node.js application using:

- Three replicas after the GitOps scaling demonstration
- Docker image `vibhord/sample-api:gitops-v1`
- Container port 3000
- CPU request: 50m
- CPU limit: 250m
- Memory request: 64Mi
- Memory limit: 128Mi
- Readiness probe: `/health`
- Liveness probe: `/health`

### Service

A ClusterIP Service exposes the application internally on port 80 and forwards requests to container port 3000.

### ConfigMap

The ConfigMap stores non-sensitive application configuration:

```yaml
PORT: "3000"
APP_ENV: "production"
```

The Deployment injects these values as environment variables.

## 6. Install Kubernetes Using kind

Create the cluster:

```bash
kind create cluster --name gitops-lab
```

Verify:

```bash
kubectl get nodes
```

## 7. Install Argo CD

Create the namespace:

```bash
kubectl create namespace argocd
```

Install Argo CD:

```bash
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

Wait for the pods:

```bash
kubectl wait --for=condition=Ready pods \
  --all -n argocd --timeout=300s
```

Access the Argo CD dashboard:

```bash
kubectl port-forward svc/argocd-server \
  -n argocd 8081:443
```

Dashboard: https://localhost:8081

Retrieve the initial admin password:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d; echo
```

Change the initial password after logging in.

## 8. Deploy the Argo CD Application

Apply the Application resource:

```bash
kubectl apply -f application.yaml
```

The Application monitors:

- Repository: `https://github.com/vibhord-work/sample-api.git`
- Branch: `main`
- Manifest directory: `k8s`
- Cluster: Local Kubernetes cluster
- Namespace: `gitops-demo`

Automated synchronization is configured with:

```yaml
syncPolicy:
  automated:
    prune: true
    selfHeal: true
  syncOptions:
    - CreateNamespace=true
```

Verify the deployment:

```bash
kubectl get applications -n argocd
kubectl get all -n gitops-demo
```

## 9. Automatic GitOps Synchronization

The initial Deployment configuration specified two replicas.

The replica count was then changed from two to three in `k8s/deployment.yaml`.

The configuration change was committed and pushed to GitHub.

Argo CD detects the updated desired state and automatically scales the Kubernetes Deployment to three replicas.

Verify:

```bash
kubectl get deployment sample-api -n gitops-demo
```

No manual `kubectl apply` is required for this Git configuration update.

## 10. Self-Healing Demonstration

The Git repository specifies three replicas.

A manual Kubernetes change can introduce configuration drift:

```bash
kubectl scale deployment sample-api \
  --replicas=6 -n gitops-demo
```

Because automated synchronization and self-healing are enabled, Argo CD detects the difference and restores the desired replica count.

Verify:

```bash
kubectl get deployment sample-api -n gitops-demo
```

Expected final state: three replicas.

## 11. Failure and Rollback Demonstration

A deliberately invalid container image is introduced in the Deployment:

```yaml
image: vibhord/sample-api:does-not-exist
```

After committing and pushing the change, Argo CD synchronizes the updated manifest.

Kubernetes cannot pull the image, producing errors such as `ErrImagePull` or `ImagePullBackOff`.

The Argo CD Application can report a Degraded health state.

### Rollback

The invalid configuration is reverted using Git:

```bash
git revert <bad-commit-hash>
git push origin main
```

Argo CD detects the reverted configuration and restores the previous valid image.

Verify:

```bash
kubectl rollout status deployment/sample-api \
  -n gitops-demo --timeout=180s
```

Expected final state: `Synced / Healthy`.

## 12. Security

No application passwords, tokens or other plaintext secrets are stored in the Git repository.

The sample application does not require database credentials or external API keys.

Non-sensitive configuration is stored in a Kubernetes ConfigMap.

If credentials are required in the future, Kubernetes Secrets can be created separately or managed through Sealed Secrets or an external secret-management solution.

Argo CD administrator credentials must not be committed to Git.

## 13. Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| OutOfSync | Git configuration differs from the cluster | Check synchronization status and controller errors |
| ImagePullBackOff | Invalid image tag or registry access issue | Verify the image exists and is accessible |
| Degraded | Kubernetes resources are unhealthy | Inspect pod events and container logs |
| Pods not ready | Application or readiness probe failure | Check `/health`, pod logs and resource settings |
| Repository error | Invalid Git URL, branch or permissions | Verify Application source configuration |
| Namespace missing | Destination namespace does not exist | Enable `CreateNamespace=true` |
| Sync failure | Invalid or unsupported manifest | Correct YAML or resource definitions and commit the fix |

Useful troubleshooting commands:

```bash
kubectl describe application sample-api -n argocd

kubectl describe pods -n gitops-demo

kubectl logs -n gitops-demo deployment/sample-api

kubectl get events -n gitops-demo --sort-by=.lastTimestamp
```

## 14. GitOps Benefits Demonstrated

- Declarative application deployment
- Git as the source of truth
- Automated Kubernetes synchronization
- Configuration drift detection
- Automatic self-healing
- Git-based deployment rollback
- Version-controlled deployment configuration
- Separation of application configuration and sensitive credentials

## 15. Conclusion

This project demonstrates a Kubernetes GitOps deployment workflow using Argo CD.

Application configuration is maintained in GitHub, while Argo CD continuously reconciles Kubernetes resources with the desired state.

The assignment covers containerized application deployment, automated synchronization, self-healing, failure troubleshooting and Git-based rollback.

**Repository:** https://github.com/vibhord-work/sample-api

**Docker Hub:** https://hub.docker.com/r/vibhord/sample-api
