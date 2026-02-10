
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";
import { Button } from "@client/components/ui/button";
import { useAuth } from "@client/provider/AuthProvider";
import axios from "axios";
import { Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";


const DocumentViewPrint = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams();
  const [doc, setDoc] = useState({
    id: "",
    name: "",
    code: "",
    releaseDate: "",
    pages: 0,
  });

  useEffect(() => {
    axios.get(`/api/modules/demo-module/document/${id}`).then((response) => {
      setDoc({
        id: response.data.id,
        name: response.data.name,
        code: response.data.code,
        releaseDate: response.data.releaseDate,
        pages: response.data.pages,
      });
    });
  }, []);

  useEffect(() => {
    document.title = `Documents - ${doc.name}`;
  }, [doc.name]);

  function onPrint() {
    window.print();
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Documents</h1>
        </div>
        <div className="ml-auto justify-end text-right px-4">
          <h2 className="text-lg font-semibold">Printing Notes</h2>
          <p className="text-sm text-muted-foreground">
            Please ensure that your document is properly formatted before printing.
          </p>
        </div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          <div className="bg-card rounded-lg border p-6 w-full">

            <div className="grid grid-cols-12 gap-2 items-start">
              <div className="mb-2 mt-3 col-span-3 md:col-span-2">
                Name
              </div>
              <div className="mb-2 mt-3 col-span-9 md:col-span-10 space-y-2">
                {doc.name}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-2 items-start">
              <div className="mb-2 mt-3 col-span-3 md:col-span-2">
                Code
              </div>
              <div className="mb-2 mt-3 col-span-9 md:col-span-10 space-y-2">
                {doc.code}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-2 items-start">
              <div className="mb-2 mt-3 col-span-3 md:col-span-2">
                Release Date
              </div>
              <div className="mb-2 mt-3 col-span-9 md:col-span-10 space-y-2">
                {doc.releaseDate?.toString()}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-2 items-start">
              <div className="mb-2 mt-3 col-span-3 md:col-span-2">
                Pages
              </div>
              <div className="mb-2 mt-3 col-span-9 md:col-span-10 space-y-2">
                {doc.pages}
              </div>
            </div>
          </div>

          <div className="flex gap-2 no-print">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Back
            </Button>
            <Button type="button" variant="outline" onClick={onPrint}>
              <Printer size={20} />Print
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(DocumentViewPrint, {
  moduleId: 'demo-module',
  moduleName: 'Demo Module'
});