FROM node:10-alpine

ENV APP_DIR=/app

COPY package.json package-lock.json $APP_DIR/
RUN chown -R node:node $APP_DIR/*

WORKDIR $APP_DIR

RUN apk add --no-cache make gcc g++ python \
  && npm install \
  && npm cache clean --force\
  && apk del make gcc g++ python

USER node

ADD . $APP_DIR

EXPOSE 7777
EXPOSE 7776

CMD ["bin/zss-broker"]
