interface event {
    callbacks: Function[];
    lastEvent: Function | null;

}

export class EventDispatcher{
    events: {[key: string]:event} = {};
    constructor(){
        
    }


    // public start
    
    addEventListener(eventName: string, callback: Function){
        this.#ensureEvent(eventName);

        let insertIndex;
        if(this.#LastEventExists(eventName)){
            insertIndex = this.#getEventLength(eventName) - 1;
        }else{
            insertIndex = this.#getEventLength(eventName);
        }


        this.events[eventName].callbacks.splice(insertIndex, 0, callback);

    };

    async dispatchEvent(eventName: string, args: any[]){
        if(this.#eventDoesNotExist(eventName)){
            return;
        }
        for(let i = 0; i < this.events[eventName].callbacks.length; i++){
            await this.events[eventName].callbacks[i](...args);
        }
    }

    ensureLastCallback(eventName:string, callback:Function){
        this.addEventListener(eventName, callback);
        this.events[eventName].lastEvent = callback;
    }

    removeEventListener(eventName:string, callback:Function){
        if(this.#eventDoesNotExist(eventName)){
            return false;
        }

        if(this.events[eventName].lastEvent === callback){
            this.events[eventName].lastEvent = null;
        }

        const indexOfCallback = this.events[eventName].callbacks.indexOf(callback);
        this.#deleteEventListenerByIndex(eventName, indexOfCallback);
    }

    // public end

    #ensureEvent(eventName:string){
        if(this.#eventDoesNotExist(eventName)){
            this.events[eventName] = {
                callbacks: [],
                lastEvent: null
            };
        }
    }

    #eventDoesNotExist(eventName:string){
        return this.events[eventName] === undefined;
    }

    #LastEventExists(eventName:string){
        return this.events[eventName].lastEvent !== null;
    }

    #getEventLength(eventName:string){
        return this.events[eventName].callbacks.length;
    }

    #deleteEventListenerByIndex(eventName:string,index:number){
        this.events[eventName].callbacks.splice(index, 1)
    }
}
