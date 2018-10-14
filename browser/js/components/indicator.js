class Indicator {
	constructor(el){
		this.el = el

		this.closedKlass = 'u-invisible'

		document.addEventListener('DOMContentLoaded', (e)=>{
			this.domReady = true // This is already executing after .onPageReady	
		})
	}

	static get selector(){ return '.indicator' }

	toggleOpen(){
		if (this.isClosed()){
			this.open()
		} else {
			this.close()
		}
	}

	isClosed(){
		return this.el.classList.includes(this.closedKlass)
	}

	open(){
		this.el.classList.remove(this.closedKlass)
	}

	close(){
		this.el.classList.add(this.closedKlass)
	}

	updateRender(vm){
		if (this.el.dataset.indicatorType === 'browserClientCodeLoading'){
			if (this.domReady) this.close()
		}
		if (this.el.dataset.indicatorType === 'waitingForServerResponse'){			
			if (vm.liveSession) this.close()
		}
	}
}

export { Indicator }