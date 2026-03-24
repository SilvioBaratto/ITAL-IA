import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MobileChatBridgeService } from './mobile-chat-bridge.service';

describe('MobileChatBridgeService', () => {
  let service: MobileChatBridgeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(MobileChatBridgeService);
  });

  it('starts with showInput=false, userInput="", isLoading=false', () => {
    expect(service.showInput()).toBe(false);
    expect(service.userInput()).toBe('');
    expect(service.isLoading()).toBe(false);
  });

  it('showInput, userInput and isLoading can be set directly', () => {
    service.showInput.set(true);
    service.userInput.set('hello');
    service.isLoading.set(true);
    expect(service.showInput()).toBe(true);
    expect(service.userInput()).toBe('hello');
    expect(service.isLoading()).toBe(true);
  });

  describe('register / unregister', () => {
    it('send() invokes the registered send callback', () => {
      const sendSpy = jasmine.createSpy('send');
      service.register({ send: sendSpy, inputChange: () => {} });
      service.send('test message');
      expect(sendSpy).toHaveBeenCalledOnceWith('test message');
    });

    it('notifyInputChange() updates userInput signal and calls inputChange callback', () => {
      const inputChangeSpy = jasmine.createSpy('inputChange');
      service.register({ send: () => {}, inputChange: inputChangeSpy });
      service.notifyInputChange('friuli');
      expect(service.userInput()).toBe('friuli');
      expect(inputChangeSpy).toHaveBeenCalledOnceWith('friuli');
    });

    it('send() is a no-op before register()', () => {
      expect(() => service.send('anything')).not.toThrow();
    });

    it('notifyInputChange() still updates the signal even before register()', () => {
      service.notifyInputChange('solo signal');
      expect(service.userInput()).toBe('solo signal');
    });

    it('send() is a no-op after unregister()', () => {
      const sendSpy = jasmine.createSpy('send');
      service.register({ send: sendSpy, inputChange: () => {} });
      service.unregister();
      service.send('ignored');
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('notifyInputChange() callback is not called after unregister()', () => {
      const inputChangeSpy = jasmine.createSpy('inputChange');
      service.register({ send: () => {}, inputChange: inputChangeSpy });
      service.unregister();
      service.notifyInputChange('ignored');
      expect(inputChangeSpy).not.toHaveBeenCalled();
    });

    it('re-registering replaces previous callbacks', () => {
      const firstSpy = jasmine.createSpy('first');
      const secondSpy = jasmine.createSpy('second');
      service.register({ send: firstSpy, inputChange: () => {} });
      service.register({ send: secondSpy, inputChange: () => {} });
      service.send('msg');
      expect(firstSpy).not.toHaveBeenCalled();
      expect(secondSpy).toHaveBeenCalledOnceWith('msg');
    });
  });
});
