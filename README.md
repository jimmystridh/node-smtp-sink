**smtp-sink is a simple testing smtp server that exposes the received mail on an http endpoint**

Useful for integration testing of e-mail sending or debugging.

Recieved mails are listed on /emails.

##Usage
```
Usage:
  index.js [OPTIONS] [ARGS]

Options: 
  -s, --smtpPort [NUMBER]SMTP port to listen on (Default is 1025)
  -h, --httpPort [NUMBER]HTTP port to listen on (Default is 1080)
  -w, --whitelist STRING Only accept e-mails from these adresses. Accepts 
                         multiple e-mails comma-separated 
  -m, --max [NUMBER]     Max number of e-mails to keep (Default is 10)
  -c, --catch            Catch unanticipated errors
```

## LICENSE

(MIT license)

Copyright (c) 2013 Jimmy Stridh <jimmy@stridh.nu>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.