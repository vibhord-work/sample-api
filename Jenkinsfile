pipeline {
    agent any

    environment {
        DOCKERHUB_USERNAME = 'vibhord'
        IMAGE = 'sample-api'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Build Image') {
            steps {
                sh '''
                    docker build \
                      -t ${DOCKERHUB_USERNAME}/${IMAGE}:${GIT_COMMIT} .
                '''
            }
        }

        stage('Publish to Docker Hub') {
            when {
                expression {
                    env.GIT_BRANCH == 'origin/main' ||
                    env.GIT_BRANCH == 'main' ||
                    env.BRANCH_NAME == 'main'
                }
            }
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-credentials',
                        usernameVariable: 'DH_USER',
                        passwordVariable: 'DH_TOKEN'
                    )
                ]) {
                    sh '''
                        set +x
                        echo "$DH_TOKEN" | docker login \
                          --username "$DH_USER" --password-stdin

                        docker push \
                          "${DOCKERHUB_USERNAME}/${IMAGE}:${GIT_COMMIT}"

                        docker logout
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully'
        }
        failure {
            echo 'Pipeline failed. Check Console Output.'
        }
    }
}
