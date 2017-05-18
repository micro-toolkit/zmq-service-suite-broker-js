if [ "$TRAVIS_BRANCH" == "master" ]; then
  /bin/bash echo "NODE VERSION ${TRAVIS_NODE_VERSION}"
  /bin/bash echo "Pushing to DockerHub..."
  docker login -e $DOCKER_EMAIL -u $DOCKER_USER -p $DOCKER_PASS
  export REPO=microtoolkit/broker
  export TAG=latest
  docker build -f Dockerfile -t $REPO:$COMMIT .
  docker tag $REPO:$COMMIT $REPO:$TAG
  docker tag $REPO:$COMMIT $REPO:travis-$TRAVIS_BUILD_NUMBER
  docker push $REPO
else
  /bin/bash echo "Docker image is built on master only"
fi
