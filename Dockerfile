FROM node:6-alpine

MAINTAINER Micro Toolkit

RUN apk add --no-cache make gcc g++ python zeromq zeromq-dev
ADD . /app
WORKDIR /app

RUN npm install --production

EXPOSE 7777
EXPOSE 7776

CMD ["npm", "start"]
