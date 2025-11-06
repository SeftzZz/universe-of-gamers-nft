import { TestBed } from '@angular/core/testing';

import { Gatcha } from './gatcha';

describe('Gatcha', () => {
  let service: Gatcha;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Gatcha);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
