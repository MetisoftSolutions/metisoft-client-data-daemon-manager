# metisoft-client-data-daemon-manager

This module provides a class, `DataDaemonManager`, which can be used to run and manage multiple data retrieval daemons. This creates an abstraction layer between your external data source and your app. You can configure daemons to retrieve data at periodic intervals or you can configure them to trigger off of events.

## Setup

After installing using Bower, include the following code in your HTML page. (This assumes your Bower modules are stored in the `lib/` directory.)
```xml
<script src="lib/metisoft-client-data-daemon-manager/src/ListenerCollection.js"></script>
<script src="lib/metisoft-client-data-daemon-manager/src/index.js"></script>
```

The `DataDaemonManager` class will now be accessible from:
```javascript
window.MetisoftSolutions.clientDataDaemonManager.DataDaemonManager
```

## Documentation

To generate documentation:
```
npm install
npm run genDocs
```
Then point your browser to `doc/jsdoc/index.html`.