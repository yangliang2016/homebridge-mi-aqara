require('./BaseParser');
const inherits = require('util').inherits;

var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen;

ContactParser = function(platform) {
    this.init(platform);
    
    Accessory = platform.Accessory;
    PlatformAccessory = platform.PlatformAccessory;
    Service = platform.Service;
    Characteristic = platform.Characteristic;
    UUIDGen = platform.UUIDGen;
}
inherits(ContactParser, BaseParser);

ContactParser.prototype.parse = function(json, rinfo) {
    this.platform.log.debug("[MiAqaraPlatform][DEBUG]" + JSON.stringify(json).trim());
    
    var data = JSON.parse(json['data']);
    var contacted = (data['status'] === 'close');
    var voltage = data['voltage'] / 1.0;
    var lowBattery = this.getLowBatteryByVoltage(voltage);
    var batteryLevel = this.getBatteryLevelByVoltage(voltage);

    var deviceSid = json['sid'];
    this.setContactAccessory(deviceSid, contacted, lowBattery, batteryLevel);
}

ContactParser.prototype.getUuidsByDeviceSid = function(deviceSid) {
    return [UUIDGen.generate('Mag' + deviceSid)];
}

ContactParser.prototype.setContactAccessory = function(deviceSid, contacted, lowBattery, batteryLevel) {
    var that = this;
    
    if(that.platform.getAccessoryDisableFrConfig(deviceSid, 'Mag')) {
        return;
    }
    
    var uuid = UUIDGen.generate('Mag' + deviceSid);
    var accessory = this.platform.getAccessoryByUuid(uuid);
    if(null == accessory) {
        var accessoryName = that.platform.getAccessoryNameFrConfig(deviceSid, 'Mag');
        accessory = new PlatformAccessory(accessoryName, uuid, Accessory.Categories.SENSOR);
        accessory.reachable = true;
        accessory.getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "Aqara")
            .setCharacteristic(Characteristic.Model, "Contact Sensor")
            .setCharacteristic(Characteristic.SerialNumber, deviceSid);
        accessory.addService(Service.ContactSensor, accessoryName);
        accessory.addService(Service.BatteryService, accessoryName);
        accessory.on('identify', function(paired, callback) {
            that.platform.log.debug("[MiAqaraPlatform][DEBUG]" + accessory.displayName + " Identify!!!");
            callback();
        });
        
        this.platform.registerAccessory(accessory);
        this.platform.log.info("[MiAqaraPlatform][INFO]create new accessory - UUID: " + uuid + ", type: Contact Sensor, deviceSid: " + deviceSid);
    }
    var magService = accessory.getService(Service.ContactSensor);
    var magCharacteristic = magService.getCharacteristic(Characteristic.ContactSensorState);
    magCharacteristic.updateValue(contacted ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
    
    if(!isNaN(lowBattery) && !isNaN(batteryLevel)) {
        var batService = accessory.getService(Service.BatteryService);
        var lowBatCharacteristic = batService.getCharacteristic(Characteristic.StatusLowBattery);
        var batLevelCharacteristic = batService.getCharacteristic(Characteristic.BatteryLevel);
        var chargingStateCharacteristic = batService.getCharacteristic(Characteristic.ChargingState);
        lowBatCharacteristic.updateValue(lowBattery);
        batLevelCharacteristic.updateValue(batteryLevel);
        chargingStateCharacteristic.updateValue(false);
    }
}

