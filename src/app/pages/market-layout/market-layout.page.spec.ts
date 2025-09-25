import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarketLayoutPage } from './market-layout.page';

describe('MarketLayoutPage', () => {
  let component: MarketLayoutPage;
  let fixture: ComponentFixture<MarketLayoutPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MarketLayoutPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
