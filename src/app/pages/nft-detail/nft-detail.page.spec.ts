import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NftDetailPage } from './nft-detail.page';

describe('NftDetailPage', () => {
  let component: NftDetailPage;
  let fixture: ComponentFixture<NftDetailPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(NftDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
