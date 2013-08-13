APPNAME=bitstarter
EXEC=web.js

node_modules:
	npm install

start: node_modules
	forever start -o $(APPNAME).log -e $(APPNAME).log --watchDirectory . $(EXEC)

stop: 
	forever stop $(EXEC)

log: 
	forever logs $(EXEC)
