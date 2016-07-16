FROM node:4.4.7
RUN apt-get update
RUN apt-get install libzmq3-dev -y
ADD . /app
WORKDIR /app

RUN npm install --production
EXPOSE 7777
EXPOSE 7776
CMD ["npm", "start"]
