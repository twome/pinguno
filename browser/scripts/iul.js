export class IUL {
	constructor(options){
		this.appHumanName = 'ISP Uptime Logger'

		this.pingIntervalMs = 1000
		this.badLatencyThresholdMs = 250
		this.pingTargets = [
			{
				userFacingName: 'Google',
				ipv4: '8.8.8.8'
			}
		]
		this.logsDir = '~/logs/' + this.appHumanName + ' logs'
		this.archiveDir = this.logsDir + '/compressed'
	}

	get currentLog(){
		return 'TODO this is the current log'
	}

}