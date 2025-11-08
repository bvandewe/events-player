#!groovy

import groovy.json.JsonSlurper

def call() {
    pipeline {
        /* In this step, you can define where your job can run.
        * In more advanced usages, you can have the entire build be run inside of a Docker containers
        * in order to use custom tools not natively supported by Jenkins.
        */
        agent any
        //tools {
        //    jdk 'JDK11'
        //}
        /*
        * Uncomment this section if you want to use specific deploy or artifact record for build
        * 'codectl get deploy' and 'codectl get artifact' gives you the list of respective IDs
        */
        environment{
            BUILD_NAME = "${env.JOB_NAME.split('/')[2]}"
            BRANCH_NAME = "${env.JOB_NAME.split('/')[3]}"
            CURRENT_STAGE = ""
            IMAGE_TAG = "${env.JOB_NAME.split('/')[3]}_${env.BUILD_NUMBER}_${env.GIT_COMMIT.substring(0,6)}"
        }

        stages {
            /* This stage runs pre-build tasks, such as loading variables or outputing start notifications
            */

             stage ('SCA Scan'){
                steps{
                    catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE'){
                        script{
                            codeQualityUtils.softwareCompositionAnalysisScan(env.GIT_URL)
                        }
                    }
                }
            }
            stage ('Secrets Scan'){
                steps{
                    catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE'){
                        script{
                            codeQualityUtils.secretsAnalysisScan(env.GIT_URL)
                        }
                    }
                }
            }

            /* In this stage, the Docker image is being created and tagged.
            */
            stage('Build') {
                steps {
                    script {
                        CURRENT_STAGE = "Build"
                        echo "Building ${BUILD_NAME} Docker Image"
                        withCredentials([usernamePassword(credentialsId: '386fd8ce-11bc-4765-9384-b3adb033e789', passwordVariable: 'token', usernameVariable: 'username')]){
                            dockerImage = docker.build("${LCP_REGISTRY_URL.substring(8)}/${BUILD_NAME}:${IMAGE_TAG}",  ". --build-arg GIT_USER=$username --build-arg GIT_TOKEN=$token")
                        }
                    }
                }
            }

            /* This steps runs your unit tests, and your SonarQube scan.
            * This stage may vary heavily depending on your project language and structure.
            */
            // stage ('Test/Sonar') {
            //     steps {
            //         script {
            //             CURRENT_STAGE = "Test/Sonar"
            //             withSonarQubeEnv('BMS SonarQube') {
            //                     sh '/bms/tools/sonar-runner/sonar-scanner-current/bin/sonar-scanner ' +
            //                     '-Dsonar.projectKey=lcp-${BUILD_NAME} ' +
            //                     '-Dsonar.projectName=lcp-${BUILD_NAME} ' +
            //                     '-Dsonar.projectVersion=${IMAGE_TAG} ' +
            //                     '-Dsonar.branch.name=${BRANCH_NAME} ' +
            //                     '-Dsonar.sources=$(pwd) ' +
            //                     '-Dsonar.language=py ' +
            //                     '-Dsonar.sourceEncoding=UTF-8 ' +
            //                     '-Dsonar.exclusions=config/**/*.yaml,*.md,*.txt,Dockerfile*,report.json,coverage.out,report.xml,values.yaml,Jenkinsfile,templates/**/*.yaml,*.yaml,Makefile,resources/ '
            //                 }
            //         }
            //     }

            //     // Make test results visible in Jenkins UI if the install step completed successfully
            //     post {
            //         success {
            //             junit testResults: 'target/surefire-reports/**/*.xml', allowEmptyResults: true
            //         }
            //     }
            // }

            stage ('Update Code Coverage to DevSecOps Hub'){
                when {
                    anyOf {
                        branch 'development';
                        branch 'main';
                        branch 'master'
                    }
                }
                steps{
                    catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE'){
                        script{
                            codeQualityUtils.updateCodeCovToHub(env.GIT_URL)
                        }
                    }
                }
            }

            /*
            * In this stage, the docker image is being pushed to the internal container registry (containers.cisco.com)
            */
            stage ('Push/Quay') {
                when {
                    anyOf {
                        branch 'master';
                        branch 'main';
                        branch 'hotfix';
                        branch 'development';
                    }
                }
                steps {
                    script {
                        CURRENT_STAGE = "Push/Quay"
                        echo "Pushing ${BUILD_NAME} Docker Image to Quay"
                        docker.withRegistry("${LCP_REGISTRY_URL}/${BUILD_NAME}", 'LEARNING-PLATFORM-QUAY') {
                            dockerImage.push("${IMAGE_TAG}")
                            dockerImage.push("latest")
                        }
                    }
                }
            }

            /*
            * In this stage, the GitHub repository is tag with the same ${IMAGE_TAG}
            */
            stage ('Tag Repository') {
                when {
                    anyOf {
                        branch 'master';
                        branch 'main'
                    }
                }
                steps {
                    script {
                        CURRENT_STAGE = "Tag Repository"
                        echo "Tagging ${BUILD_NAME} Repository with image tag ${IMAGE_TAG}"
                        try {
                            withCredentials([usernamePassword(credentialsId: '386fd8ce-11bc-4765-9384-b3adb033e789', passwordVariable: 'token', usernameVariable: 'username')]){
                                sh 'git config --local url."https://${username}:${token}@wwwin-github.cisco.com".insteadOf "https://wwwin-github.cisco.com"'
                                //create tag
                                sh "git tag ${IMAGE_TAG}"
                                //push tag
                                sh "git push origin --tags"
                            }
                        } catch(Exception e) {
                            echo "Could not tag repository: ${e}"
                        }
                    }
                }
            }
        }

        post {
            always {
                generateBuildDetails()
                script {
                    withCredentials([
                        usernamePassword(credentialsId: '386fd8ce-11bc-4765-9384-b3adb033e789', passwordVariable: 'token', usernameVariable: 'username'),
                        usernamePassword(credentialsId: 'LEARNING-PLATFORM-QUAY', passwordVariable: 'quayToken', usernameVariable: 'quayUser'),
                        usernamePassword(credentialsId: 'ROUGAROU_WEBEX_APP', passwordVariable: 'botToken', usernameVariable: 'botId')
                    ]) {
                            sh 'docker login -u $quayUser -p $quayToken $LCP_QUAY_SERVER'

                            sh 'docker run -e WEBEX_SPACE_ID=$WEBEX_SPACE_ID -e WEBEX_TOKEN=$botToken -v $(pwd):/build $BUILD_NOTIFICATION_IMAGE'
                    }
                }
                cleanWs deleteDirs: true
            }
        }
    }
}

def generateBuildDetails() {
    def data =  [
        buildName : env.BUILD_NAME,
        buildNumber: env.BUILD_NUMBER,
        buildStatus: "${currentBuild.currentResult}",
        failedStage: "${CURRENT_STAGE}",
        buildTime: new Date().format("yyyy-MMM-dd HH:mm:ss z", TimeZone.getTimeZone('UTC')),
        buildUrl: env.BUILD_URL,
        gitHubDetails : [
            url: env.GIT_URL,
            branchName: env.GIT_BRANCH,
            commit: env.GIT_COMMIT,
            author: sh (script: 'git log -1 --format="%aN" ${GIT_COMMIT}', returnStdout: true).trim()
        ]
    ]

    writeJSON(file: 'build_detail.json', json: data)
}

call()
