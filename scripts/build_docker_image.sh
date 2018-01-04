if [ "$TRAVIS_BRANCH" == "master" ]; then
  echo "NODE VERSION ${TRAVIS_NODE_VERSION}"
  echo "Pushing to DockerHub..."
  docker login -u $DOCKER_USER -p $DOCKER_PASS
  export REPO=microtoolkit/broker
  export TAG=latest
  docker build -f Dockerfile -t $REPO:$COMMIT .
  docker tag $REPO:$COMMIT $REPO:$TAG
  docker tag $REPO:$COMMIT $REPO:travis-$TRAVIS_BUILD_NUMBER
  docker push $REPO
else
  echo "Docker image is built on master only"
fi
