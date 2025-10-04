import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyNftsPage } from './my-nfts.page';

describe('MyNftsPage', () => {
  let component: MyNftsPage;
  let fixture: ComponentFixture<MyNftsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MyNftsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
