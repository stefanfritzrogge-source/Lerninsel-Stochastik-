#!/bin/bash
cd "$(dirname "$0")"
echo 'Die Lerninsel startet auf http://localhost:3000'
echo 'Dieses Terminal im Unterricht geöffnet lassen.'
open 'http://localhost:3000'
node server.mjs
