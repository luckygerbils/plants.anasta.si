FROM ubuntu:latest

# Install utils
RUN apt-get update && apt-get -y install mandoc less curl xz-utils unzip

# Install NodeJS
RUN curl -o /tmp/node.tar.xz https://nodejs.org/dist/v20.19.0/node-v20.19.0-linux-x64.tar.xz \
    && tar --strip-components 1 -xvf /tmp/node.tar.xz --directory /usr/local/

# Install AWS CLI
RUN mkdir /tmp/awscli \
    && curl -o "/tmp/awscli/awscli.zip" "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" \
    && cd /tmp/awscli \
    && unzip ./awscli.zip \
    && ./aws/install

# Install JQ
RUN curl -L -o /usr/local/bin/jq https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-linux-amd64 \
    && chmod a+x /usr/local/bin/jq

# Add container user with same uid & git as current user
ARG uid gid
RUN groupadd --gid $gid user || true \
    && useradd --uid $uid --gid $gid --shell /bin/bash --create-home user || true \
    && usermod --login user --home /home/user $(id -un $uid) \
    && groupmod --new-name user $(getent group $gid | cut -d: -f1) \
    && mkdir /home/user \
    && chown user:user /home/user
USER user:user

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV HAVE_TOOLS=true

ARG lambda_dev_port website_dev_port
EXPOSE $lambda_dev_port
EXPOSE $website_dev_port

WORKDIR /usr/src/app