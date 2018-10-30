class ErrorCannotAccessProperty extends Error {
  constructor(currentPropPathKey, currentPropPathValue, nextPropKey, messageForSuper = ''){
    super(messageForSuper)
    this.message = `ErrorCannotAccessProperty: Property ${nextPropKey} can't be accesssed because ${currentPropPathKey} has value ${currentPropPathValue}`
  }
}

class ErrorInvalidPropertyKey extends Error {
	constructor(propKey, messageForSuper = ''){
		super(messageForSuper)
		this.message = `ErrorInvalidPropertyKey: Property ${propKey} has a period "." in its name, which is not allowed as it could lead to confusion.`
	}
}

export { ErrorInvalidPropertyKey, ErrorCannotAccessProperty }