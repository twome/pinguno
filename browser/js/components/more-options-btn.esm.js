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

		let toggleBtnEl = this.el.querySelector('.c-more-options-btn__list-toggle')
		toggleBtnEl.addEventListener('click', e => {
			this.toggleOpen()
		})

		let eachListEl = this.el.querySelectorAll('.c-more-options-btn__list button')
		for (let el of eachListEl){
			el.addEventListener('click', e => {
				this.close()
			})
		}
	}

	toggleOpen(){
		let listEl = this.el.querySelector('.c-more-options-btn__list')
		if (listEl.classList.contains('u-hidden')){
			this.open()
		} else {
			this.close()
		}
	}

	open(){
		let listEl = this.el.querySelector('.c-more-options-btn__list')
		listEl.classList.remove('u-hidden')
	}

	close(){
		let listEl = this.el.querySelector('.c-more-options-btn__list')
		listEl.classList.add('u-hidden')
	}

	/* Standard features */
	onEscape(event){
		this.close()
	}
}


export { MoreOptionsBtn }