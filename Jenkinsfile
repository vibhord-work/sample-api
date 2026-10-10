pipeline {
    agent any

    environment {
        IMAGE = 'sample-api'
    }

    stages {
        stage('Checkout'){
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
                sh 'docker build -t $IMAGE:BUILD_NUMBER .'
            }
        }
    }
    post {
        success {
            echo 'Build succeded'
        }
        failure {
            echo 'Build failed - read the stage log'
        }
    }
}