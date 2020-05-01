#!/bin/bash
set -e
set -u

APP=$1
MONOREPO_ROOT=$(cd ../../ && pwd)
PACKAGES=$MONOREPO_ROOT/packages
E2E_ROOT=$PACKAGES/e2e-tests
PORT=8545
GANACHE_DEPLOYMENTS=$MONOREPO_ROOT/.ganache-deployments/ganache-deployments-$PORT.json

WAIT_ON_TIMEOUT=60000
WAIT_ON_INTERVAL=5000
WAIT_ON_DELAY=5000

cleanup() {
  if test -f $GANACHE_DEPLOYMENTS; then
    rm $GANACHE_DEPLOYMENTS
  fi
}

# On exit signals, kill self & child processes 
# For some reason, the `node scripts/start.js` command in xstate-wallet
# does not immediately terminate, even if I send the KILL signal (kill 0 -9)
# It seems to wait for compilation to succeed, and then terminates, which can
# take ~30s on my machine.
trap "cleanup && kill -INT 0 && wait" SIGINT SIGTERM EXIT

if test -f $GANACHE_DEPLOYMENTS; then
  echo $GANACHE_DEPLOYMENTS exists. Perhaps Ganache is running on port $PORT
  exit 1
fi

cd $PACKAGES/devtools
yarn start:shared-ganache | tee $E2E_ROOT/shared-ganache.log & 

yarn run wait-on -t $WAIT_ON_TIMEOUT -i $WAIT_ON_INTERVAL $MONOREPO_ROOT/.ganache-deployments/ganache-deployments-8545.json

cd $PACKAGES/$APP 
yarn start | tee $E2E_ROOT/$APP.log &

cd $PACKAGES/xstate-wallet
yarn start | tee $E2E_ROOT/xstate-wallet.log &

cd $PACKAGES/simple-hub
yarn hub:watch | tee $E2E_ROOT/hub.log &

wait