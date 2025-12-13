#!/bin/bash

sudo apt update && sudo apt -y upgrade
sudo apt -y intall ufw curl unzip wget gpg apt-transport-https jq build-essential
sudo apt -y install OpenSSH
sudo ufw allow OpenSSH
sudo ufw allow 8080/tcp 3000/tcp 4000/tcp
sudo ufw --force enable
sudo ufw status verbose

wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/adoptium.gpg
echo "deb https://packages.adoptium.net/artifactory/deb $(. /etc/os-release; echo $VERSION_CODENAME) main" | sudo tee /etc/apt/sources.list.d/adoptium.list
sudo apt update && sudo apt -y install temurin-21-jdk

sudo apt -y install postgresql

curl -fsSL https://deb.nodesource.com/setup_24.11 | sudo -E bash -
sudo apt -y install nodejs

cd /opt/
wget https://github.com/keycloak/keycloak/releases/download/26.4.6/keycloak-26.4.6.zip
unzip keycloak-26.4.6.zip && mv keycloak-26.4.6 keycloak
sudo chown -R $USER:$USER /opt/keycloak
chmod -R 755 /opt/keycloak
