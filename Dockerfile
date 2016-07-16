FROM node:4.4.7

MANTAINER Micro Toolkit

RUN apt-get update
RUN apt-get install libzmq3-dev -y
ADD . /app
WORKDIR /app

RUN rm -rf node_modules
RUN npm install
EXPOSE 7777
EXPOSE 7776
CMD ["npm", "start"]
