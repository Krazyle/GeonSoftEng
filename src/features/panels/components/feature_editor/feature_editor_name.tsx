import type { IWrappedFeature } from "types";
import { inputClass } from "@/components/elements";
import { captureException } from "@/lib/integrations/errors";
import { updatePropertyValue } from "@/utils/map_operations/update_property_value";
import { usePersistence } from "@/utils/persistence/context";

export function FeatureEditorName({
  wrappedFeature,
}: {
  wrappedFeature: IWrappedFeature;
}) {
  const rep = usePersistence();
  const transact = rep.useTransact();
  const { feature } = wrappedFeature;
  const name = (feature.properties?.title ||
    feature.properties?.name ||
    "") as string;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    const newFeature = updatePropertyValue(feature, { key: "title", value });
    transact({
      putFeatures: [
        {
          ...wrappedFeature,
          feature: newFeature,
        },
      ],
    }).catch((e) => captureException(e));
  };

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
      <div className="flex flex-col gap-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 pl-1">
          Feature Name
        </label>
        <input
          type="text"
          className={`${inputClass({ _size: "md" })} rounded-xl!`}
          placeholder="Unnamed feature"
          value={name}
          onChange={handleChange}
          aria-label="Feature Name"
        />
      </div>
    </div>
  );
}
