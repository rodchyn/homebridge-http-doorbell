var Service;
var Characteristic;
var http = require('http');

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerPlatform("homebridge-rodchyn-http-doorbell", "http-doorbell", HTTPDoorbell);
};

function HTTPDoorbell(log, config) {
    this.log = log;
    this.port = config.port;
    this.bells = config.doorbells;
    this.bellsAccessories = [];
    this.bellsLastRang = [];
    var self = this;
    this.server = http.createServer(function(request, response) {
        self.httpHandler(self, request.url.substring(1));
        response.end('Handled');
    });
    this.server.listen(this.port, function(){
        self.log("Doorbell server listening on: http://<your ip goes here>:%s/<doorbellId>", self.port);
    });
}

HTTPDoorbell.prototype.accessories = function (callback) {
    var foundAccessories = [];
    var count = this.bells.length;
    for (index = 0; index < count; index++) {
        var accessory = new DoorbellAccessory(this.bells[index]);
        if (accessory.doorbellId == 0) {
            accessory.doorbellId = index+1;
        }
        this.bellsAccessories[accessory.doorbellId] = accessory;
        foundAccessories.push(accessory);
    }
    callback(foundAccessories);
}

HTTPDoorbell.prototype.httpHandler = function(that, doorbellId) {
    if (that.bellsLastRang[doorbellId]) {
        var diff = new Date().getTime() - that.bellsLastRang[doorbellId];
        if (diff/1000 < 10) {
            return;
        }
    }
    that.bellsLastRang[doorbellId] = new Date().getTime();
    that.bellsAccessories[doorbellId].ring();
};

function DoorbellAccessory(config) {
    this.name = config["name"];
    this.duration = config["duration"] || 2;
    this.doorbellId = config["id"] || 0;
    this.binaryState = 0;
    this.service = null;
    this.timeout = null;
}

DoorbellAccessory.prototype.getServices = function() {
    var informationService = new Service.AccessoryInformation();
    informationService
        .setCharacteristic(Characteristic.Manufacturer, "Rodchyn Inc.")
        .setCharacteristic(Characteristic.Model, "Rodchyn Doorbell")
        .setCharacteristic(Characteristic.SerialNumber, this.doorbellId);
    
    this.service = new Service.Doorbell(this.name);
    this.service
        .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
        .on('get', this.getState.bind(this));
    return [informationService, this.service];
}

DoorbellAccessory.prototype.getState = function(callback) {
    callback(null, this.binaryState > 0);
}

DoorbellAccessory.prototype.ring = function() {
    self.log("BEEP! BOOP!");
    this.binaryState = 1;
    this.service.getCharacteristic(Characteristic.ProgrammableSwitchEvent).updateValue(this.binaryState == 1);
    if (this.timeout) {
        clearTimeout(this.timeout);
    }
    var self = this;
    this.timeout = setTimeout(function() {
        self.binaryState = 0;
        self.service.getCharacteristic(Characteristic.ProgrammableSwitchEvent).updateValue(self.binaryState == 1);
        self.timeout = null;
    }, self.duration * 1000);
}


DoorbellAccessory.prototype.identify = function(callback) {
    this.log("Identify requested!");

    var targetChar = this.service
    .getCharacteristic(Characteristic.ProgrammableSwitchEvent);

    this.log("targetChar:", targetChar);

    if (targetChar.value == "1"){
	targetChar.setValue(0);
	this.log("Toggle state to 0");
    }
    else{
	targetChar.setValue(1);
	this.log("Toggle state to 1");
    }
    callback(); // success
}
