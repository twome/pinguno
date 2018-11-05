// Built-in
const os = require('os')

// Credit https://stackoverflow.com/a/8440736/1129420
let getLocalIP =()=>{
	let netInterfaces = os.networkInterfaces()
	let finalAddresses = []

	Object.keys(netInterfaces).forEach((ifname)=>{
		let alias = 0

		netInterfaces[ifname].forEach((netInterface)=>{
			if (netInterface.family !== 'IPv4' || netInterface.internal !== false) {
				// Skip over internal (i.e. 127.0.0.1) and non-IPV4 addresses
				return
			}

			if (alias >= 1) {
				// This single netInterface has multiple IPV4 addresses
				finalAddresses.push({
					ifname, 
					alias, 
					address: netInterface.address
				})
			} else {
				// This netInterface has only one IPV4 address
				finalAddresses.push({
					ifname,
					address: netInterface.address
				})
			}

			alias += 1
		})
	})

	return finalAddresses
}

export { getLocalIP }