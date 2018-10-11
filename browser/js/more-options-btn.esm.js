class MoreOptionsBtn {
	constructor(el){
		this.el = el
		this.registerInputHandlers()
	}

	static get selector(){ return '.js-more-options-btn' }

	registerInputHandlers(){
		this.el.addEventListener('focusout', e => {
			if (!this.el.contains(e.relatedTarget)){
				this.close()
			}
		}, true)

		let toggleBtnEl = this.el.querySelector('.more-options-btn__list-toggle')
		toggleBtnEl.addEventListener('click', e => {
			this.toggleOpen()
		})

		let eachListEl = this.el.querySelectorAll('.more-options-btn__list button')
		for (let el of eachListEl){
			el.addEventListener('click', e => {
				this.close()
			})
		}
	}

	toggleOpen(){
		let listEl = this.el.querySelector('.more-options-btn__list')
		if (listEl.classList.contains('hidden')){
			this.open()
		} else {
			this.close()
		}
	}

	open(){
		let listEl = this.el.querySelector('.more-options-btn__list')
		listEl.classList.remove('hidden')
	}

	close(){
		let listEl = this.el.querySelector('.more-options-btn__list')
		listEl.classList.add('hidden')
	}

	/* Standard features */
	onEscape(event){
		this.close()
	}
}


export { MoreOptionsBtn }