import { useParams } from "react-router-dom";
import { BrandDetailPage, BrandRegisterPage } from "../redesign/brand";
import { BuyerDetailPage, BuyerRegisterPage } from "../redesign/buyer";
import { ContactDetailPage, ContactRegisterPage } from "../redesign/contact";
import { ProductDetailPage, ProductRegisterPage } from "../redesign/product";

type RecordType = "brand" | "product" | "business" | "contact";

function validType(value: string | undefined): value is RecordType {
  return value === "brand" || value === "product" || value === "business" || value === "contact";
}

export function RecordsPage() {
  const params = useParams();
  const type = validType(params.type) ? params.type : "brand";
  if (type === "product") {
    return (
      <ProductRegisterPage
        compatibility={{
          registerPath: "/records/product",
          detailPath: (recordId) => `/records/product/${recordId}`,
          showCompatibilityNotice: true
        }}
      />
    );
  }
  if (type === "brand") {
    return (
      <BrandRegisterPage
        compatibility={{
          registerPath: "/records/brand",
          detailPath: (recordId) => `/records/brand/${recordId}`,
          showCompatibilityNotice: true
        }}
      />
    );
  }
  if (type === "business") {
    return (
      <BuyerRegisterPage
        compatibility={{
          registerPath: "/records/business",
          detailPath: (recordId) => `/records/business/${recordId}`,
          showCompatibilityNotice: true
        }}
      />
    );
  }
  return (
    <ContactRegisterPage
      compatibility={{
        registerPath: "/records/contact",
        detailPath: (recordId) => `/records/contact/${recordId}`,
        showCompatibilityNotice: true
      }}
    />
  );
}

export function RecordDetailPage() {
  const params = useParams();
  const type = validType(params.type) ? params.type : "brand";
  if (type === "product") {
    return (
      <ProductDetailPage
        compatibility={{
          registerPath: "/records/product",
          detailPath: (recordId) => `/records/product/${recordId}`,
          showCompatibilityNotice: true
        }}
      />
    );
  }
  if (type === "brand") {
    return (
      <BrandDetailPage
        compatibility={{
          registerPath: "/records/brand",
          detailPath: (recordId) => `/records/brand/${recordId}`,
          showCompatibilityNotice: true
        }}
      />
    );
  }
  if (type === "business") {
    return (
      <BuyerDetailPage
        compatibility={{
          registerPath: "/records/business",
          detailPath: (recordId) => `/records/business/${recordId}`,
          showCompatibilityNotice: true
        }}
      />
    );
  }
  return (
    <ContactDetailPage
      compatibility={{
        registerPath: "/records/contact",
        detailPath: (recordId) => `/records/contact/${recordId}`,
        showCompatibilityNotice: true
      }}
    />
  );
}
