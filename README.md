# NCD Comm

This library provides the basic communication classes used by the ncd-red-* modules for ncd.io devices. You generally should not need to install this library, as it will be included as a dependency by other libraries as needed.

When using Node-Red, this library provides a configuration node to supply I2C communication to the other NCD nodes.

This library provides classes for communicating with a native I2C bus (via the node i2c-bus package) and a USB to I2C converter available from [ncd.io](https://store.ncd.io/product/usb-to-i2c-converter-with-virtual-com-port-ft230xs/)

Neat trick... run this in a bash console to install all of our ncd-red packages!

`npm i $(npm search --parseable ncd-red | cut -f 1)`
