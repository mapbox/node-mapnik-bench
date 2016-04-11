#!/usr/bin/env bash

set -e

# install basic node deps
npm install

# install latest
(cd mapnik-versions/latest && npm install && npm ls mapnik tilelive-bridge)