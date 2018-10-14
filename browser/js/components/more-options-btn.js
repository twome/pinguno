import { config } from '../config.js'

class MoreOptionsBtn {
	constructor(el){
		this.el = el
		this.el.setAttribute('data-' + config.appDomPrefix + 'custom-class', 'more-options-btn')
	
		this.toggleElSel = '.c-more-options-btn__list-toggle'
		this.listElSel = '.c-more-options-btn__list'
		this.listBtnElSel = '.c-more-options-btn__list button'

		this.registerInputHandlers()
	}

	static get selector(){ return '.js-more-options-btn' }

	registerInputHandlers(){
		this.el.addEventListener('focusout', e => {
			if (!this.el.contains(e.relatedTarget)){
				this.close()
			}
		}, true)

		let toggleBtnEl = this.el.querySelector(this.toggleElSel)
		toggleBtnEl.addEventListener('click', e => {
			this.toggleOpen()
		})

		let eachListEl = this.el.querySelectorAll(this.listBtnElSel)
		for (let el of eachListEl){
			el.addEventListener('click', e => {
				this.close()
			})
		}

		document.addEventListener('keydown', e => {
			if (e.which === 27){ // Esc
				this.escape()
				e.preventDefault()
			}
		})
	}

	toggleOpen(){
		let listEl = this.el.querySelector(this.listElSel)
		if (listEl.classList.contains('u-hidden')){
			this.open()
		} else {
			this.close()
		}
	}

	open(){
		let listEl = this.el.querySelector(this.listElSel)
		listEl.classList.remove('u-hidden')
	}

	close(){
		let listEl = this.el.querySelector(this.listElSel)
		listEl.classList.add('u-hidden')
	}

	/* Standard features */
	escape(event){
		this.close()
	}
}


export { MoreOptionsBtn }